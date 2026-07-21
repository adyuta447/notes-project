#![cfg(test)]

use super::*;
use soroban_sdk::Env;

#[test]
fn test_create_and_get_notes() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NotesContract);
    let client = NotesContractClient::new(&env, &contract_id);

    let title = String::from_str(&env, "Judul Pertama");
    let content = String::from_str(&env, "Isi catatan pertama");

    let result = client.create_note(&title, &content);
    assert_eq!(result, String::from_str(&env, "Notes berhasil ditambahkan"));

    let notes = client.get_notes();
    assert_eq!(notes.len(), 1);

    let note = notes.get(0).unwrap();
    assert_eq!(note.id, 1);
    assert_eq!(note.title, title);
    assert_eq!(note.content, content);
}

#[test]
fn test_multiple_notes_have_unique_incrementing_ids() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NotesContract);
    let client = NotesContractClient::new(&env, &contract_id);

    client.create_note(
        &String::from_str(&env, "Note 1"),
        &String::from_str(&env, "Content 1"),
    );
    client.create_note(
        &String::from_str(&env, "Note 2"),
        &String::from_str(&env, "Content 2"),
    );

    let notes = client.get_notes();
    assert_eq!(notes.len(), 2);
    assert_eq!(notes.get(0).unwrap().id, 1);
    assert_eq!(notes.get(1).unwrap().id, 2);
}

#[test]
fn test_delete_note() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NotesContract);
    let client = NotesContractClient::new(&env, &contract_id);

    client.create_note(
        &String::from_str(&env, "Test Hapus"),
        &String::from_str(&env, "Konten test"),
    );

    let notes = client.get_notes();
    let id = notes.get(0).unwrap().id;

    let result = client.delete_note(&id);
    assert_eq!(result, String::from_str(&env, "Berhasil hapus notes"));

    let notes_after = client.get_notes();
    assert_eq!(notes_after.len(), 0);
}

#[test]
fn test_delete_note_not_found() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NotesContract);
    let client = NotesContractClient::new(&env, &contract_id);

    let result = client.delete_note(&999);
    assert_eq!(result, String::from_str(&env, "Notes tidak ditemukan"));
}

#[test]
fn test_update_note() {
    let env = Env::default();
    let contract_id = env.register_contract(None, NotesContract);
    let client = NotesContractClient::new(&env, &contract_id);

    client.create_note(
        &String::from_str(&env, "Judul Lama"),
        &String::from_str(&env, "Konten Lama"),
    );

    let notes = client.get_notes();
    let id = notes.get(0).unwrap().id;

    let new_title = String::from_str(&env, "Judul Baru");
    let new_content = String::from_str(&env, "Konten Baru");
    client.update_note(&id, &new_title, &new_content);

    let notes_after = client.get_notes();
    let note = notes_after.get(0).unwrap();
    assert_eq!(note.title, new_title);
    assert_eq!(note.content, new_content);
}