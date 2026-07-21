#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Env, String, Symbol, Vec};

// Struktur data yang akan menyimpan notes
#[contracttype]
#[derive(Clone, Debug)]
pub struct Note {
    pub id: u64,
    pub title: String,
    pub content: String,
}

// Storage key untuk data notes
const NOTE_DATA: Symbol = symbol_short!("NOTE_DATA");
// Storage key untuk counter id (biar id selalu unik & berurutan)
const NOTE_CNT: Symbol = symbol_short!("NOTE_CNT");

// TTL untuk instance storage (dalam ledger, ~5 detik per ledger di mainnet/testnet)
const BUMP_LOW: u32 = 100_000;
const BUMP_HIGH: u32 = 200_000;

#[contract]
pub struct NotesContract;

#[contractimpl]
impl NotesContract {
    /// Ambil semua notes
    pub fn get_notes(env: Env) -> Vec<Note> {
        env.storage()
            .instance()
            .get(&NOTE_DATA)
            .unwrap_or(Vec::new(&env))
    }

    /// Fungsi untuk membuat note baru
    pub fn create_note(env: Env, title: String, content: String) -> String {
        // 1. ambil data notes dari storage
        let mut notes: Vec<Note> = env
            .storage()
            .instance()
            .get(&NOTE_DATA)
            .unwrap_or(Vec::new(&env));

        // 2. ambil & naikkan counter id (lebih stabil dibanding prng untuk id)
        let mut counter: u64 = env.storage().instance().get(&NOTE_CNT).unwrap_or(0);
        counter += 1;

        // 3. Buat object note baru
        let note = Note {
            id: counter,
            title,
            content,
        };

        // 4. tambahkan note baru ke notes lama
        notes.push_back(note);

        // 5. simpan notes & counter ke storage
        env.storage().instance().set(&NOTE_DATA, &notes);
        env.storage().instance().set(&NOTE_CNT, &counter);

        // 6. perpanjang TTL supaya data tidak diarsipkan otomatis
        env.storage().instance().extend_ttl(BUMP_LOW, BUMP_HIGH);

        String::from_str(&env, "Notes berhasil ditambahkan")
    }

    /// Fungsi untuk menghapus notes berdasarkan id
    pub fn delete_note(env: Env, id: u64) -> String {
        // 1. ambil data notes dari storage
        let mut notes: Vec<Note> = env
            .storage()
            .instance()
            .get(&NOTE_DATA)
            .unwrap_or(Vec::new(&env));

        // 2. cari index note yang akan dihapus menggunakan perulangan
        for i in 0..notes.len() {
            if notes.get(i).unwrap().id == id {
                notes.remove(i);
                env.storage().instance().set(&NOTE_DATA, &notes);
                env.storage().instance().extend_ttl(BUMP_LOW, BUMP_HIGH);
                return String::from_str(&env, "Berhasil hapus notes");
            }
        }

        String::from_str(&env, "Notes tidak ditemukan")
    }

    /// Fungsi tambahan untuk update note (opsional, tapi berguna buat level 1)
    pub fn update_note(env: Env, id: u64, title: String, content: String) -> String {
        let mut notes: Vec<Note> = env
            .storage()
            .instance()
            .get(&NOTE_DATA)
            .unwrap_or(Vec::new(&env));

        for i in 0..notes.len() {
            let mut note = notes.get(i).unwrap();
            if note.id == id {
                note.title = title;
                note.content = content;
                notes.set(i, note);
                env.storage().instance().set(&NOTE_DATA, &notes);
                env.storage().instance().extend_ttl(BUMP_LOW, BUMP_HIGH);
                return String::from_str(&env, "Berhasil update notes");
            }
        }

        String::from_str(&env, "Notes tidak ditemukan")
    }
}

mod test;