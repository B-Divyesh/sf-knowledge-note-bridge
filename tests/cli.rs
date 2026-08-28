use serde_json::{json, Value};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;

fn read_request(stream: &mut TcpStream) -> Value {
    let mut data = Vec::new();
    let mut buffer = [0; 2048];
    loop {
        let read = stream.read(&mut buffer).unwrap();
        data.extend_from_slice(&buffer[..read]);
        let Some(headers_end) = data.windows(4).position(|window| window == b"\r\n\r\n") else {
            continue;
        };
        let headers = String::from_utf8_lossy(&data[..headers_end]);
        let length = headers
            .lines()
            .find_map(|line| {
                line.to_ascii_lowercase()
                    .strip_prefix("content-length:")
                    .map(|value| value.trim().parse::<usize>().unwrap())
            })
            .unwrap_or(0);
        if data.len() >= headers_end + 4 + length {
            return serde_json::from_slice(&data[headers_end + 4..headers_end + 4 + length])
                .unwrap();
        }
    }
}

fn mock_anki(expected_calls: usize) -> (String, Arc<Mutex<Vec<String>>>, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let calls = Arc::new(Mutex::new(Vec::new()));
    let recorded = calls.clone();
    let handle = thread::spawn(move || {
        for _ in 0..expected_calls {
            let (mut stream, _) = listener.accept().unwrap();
            let body = read_request(&mut stream);
            let action = body["action"].as_str().unwrap().to_owned();
            recorded.lock().unwrap().push(action.clone());
            let result = match action.as_str() {
                "version" => json!(6),
                "findNotes" => json!([]),
                "deckNames" => json!(["Default"]),
                "exportPackage" => json!(true),
                "addNote" => json!(17041),
                other => panic!("unexpected action {other}"),
            };
            let response = json!({"result": result, "error": null}).to_string();
            write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", response.len(), response).unwrap();
        }
    });
    (format!("http://{address}"), calls, handle)
}

#[test]
fn sync_backs_up_before_first_write_and_records_report() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(
        dir.path().join("cards.md"),
        "```card\nid: safe-id\ndeck: Default\n---\nQuestion?\n---\nAnswer.\n```\n",
    )
    .unwrap();
    let (endpoint, calls, server) = mock_anki(2);
    let plan_output = Command::new(env!("CARGO_BIN_EXE_knb"))
        .current_dir(dir.path())
        .args(["plan", "cards.md", "--json", "--endpoint", &endpoint])
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(plan_output.status.success());
    fs::write(dir.path().join("approved-plan.json"), &plan_output.stdout).unwrap();
    assert_eq!(*calls.lock().unwrap(), ["version", "findNotes"]);

    let (endpoint, calls, server) = mock_anki(5);
    let output = Command::new(env!("CARGO_BIN_EXE_knb"))
        .current_dir(dir.path())
        .args([
            "sync",
            "cards.md",
            "--yes",
            "--plan",
            "approved-plan.json",
            "--endpoint",
            &endpoint,
        ])
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(
        *calls.lock().unwrap(),
        [
            "version",
            "findNotes",
            "deckNames",
            "exportPackage",
            "addNote"
        ]
    );
    let report_dir = dir.path().join(".knb/reports");
    let report = fs::read_to_string(
        fs::read_dir(report_dir)
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path(),
    )
    .unwrap();
    assert!(report.contains("001-Default.apkg"));
    assert!(report.contains("approved-plan.json"));
    assert!(report.contains("\"status\": \"complete\""));
}

#[test]
fn sync_rejects_missing_or_stale_approval_before_backup_or_write() {
    let dir = tempfile::tempdir().unwrap();
    let cards = dir.path().join("cards.md");
    fs::write(
        &cards,
        "```card\nid: safe-id\ndeck: Default\n---\nQuestion?\n---\nAnswer.\n```\n",
    )
    .unwrap();

    let (endpoint, calls, server) = mock_anki(2);
    let unapproved = Command::new(env!("CARGO_BIN_EXE_knb"))
        .current_dir(dir.path())
        .args(["sync", "cards.md", "--yes", "--endpoint", &endpoint])
        .output()
        .unwrap();
    server.join().unwrap();
    assert_eq!(unapproved.status.code(), Some(3));
    assert!(String::from_utf8_lossy(&unapproved.stderr).contains("requires --plan FILE"));
    assert_eq!(*calls.lock().unwrap(), ["version", "findNotes"]);

    let (endpoint, calls, server) = mock_anki(2);
    let plan_output = Command::new(env!("CARGO_BIN_EXE_knb"))
        .current_dir(dir.path())
        .args(["plan", "cards.md", "--json", "--endpoint", &endpoint])
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(plan_output.status.success());
    assert_eq!(*calls.lock().unwrap(), ["version", "findNotes"]);
    fs::write(dir.path().join("approved-plan.json"), &plan_output.stdout).unwrap();

    fs::write(
        &cards,
        "```card\nid: safe-id\ndeck: Default\n---\nQuestion changed?\n---\nAnswer.\n```\n",
    )
    .unwrap();
    let (endpoint, calls, server) = mock_anki(2);
    let output = Command::new(env!("CARGO_BIN_EXE_knb"))
        .current_dir(dir.path())
        .args([
            "sync",
            "cards.md",
            "--yes",
            "--plan",
            "approved-plan.json",
            "--endpoint",
            &endpoint,
        ])
        .output()
        .unwrap();
    server.join().unwrap();
    assert_eq!(output.status.code(), Some(3));
    assert!(String::from_utf8_lossy(&output.stderr).contains("no longer matches"));
    assert_eq!(*calls.lock().unwrap(), ["version", "findNotes"]);
}

#[test]
fn check_json_is_one_scriptable_value() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(
        dir.path().join("cards.md"),
        "```card\nid: safe-id\n---\nQ\n---\nA\n```\n",
    )
    .unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_knb"))
        .current_dir(dir.path())
        .args(["check", "cards.md", "--json"])
        .output()
        .unwrap();
    assert!(output.status.success());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["cards"], 1);
}
