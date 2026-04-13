package service

import (
	"strings"
	"testing"
)

// ── EncryptData / DecryptData ────────────────────────────────────────────────

func TestEncryptDecryptRoundtrip(t *testing.T) {
	cases := []string{
		"hello world",
		"cookie:AQEDATxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
		"",
		strings.Repeat("A", 1000), // large input
		"special !@#$%^&*()_+-=[]{}|;':\",./<>?",
	}
	for _, plaintext := range cases {
		encrypted, err := EncryptData(plaintext)
		if err != nil {
			t.Fatalf("EncryptData(%q) error: %v", plaintext, err)
		}
		decrypted, err := DecryptData(encrypted)
		if err != nil {
			t.Fatalf("DecryptData error for input %q: %v", plaintext, err)
		}
		if decrypted != plaintext {
			t.Errorf("Roundtrip failed: got %q, want %q", decrypted, plaintext)
		}
	}
}

func TestEncryptProducesDifferentCiphertextEachTime(t *testing.T) {
	plaintext := "same-input-different-nonce"
	c1, _ := EncryptData(plaintext)
	c2, _ := EncryptData(plaintext)
	if c1 == c2 {
		t.Error("AES-GCM should produce different ciphertext on each call due to random nonce")
	}
}

func TestDecryptBadBase64(t *testing.T) {
	_, err := DecryptData("not!!valid!!base64")
	if err == nil {
		t.Error("expected error for bad base64, got nil")
	}
}

func TestDecryptTooShort(t *testing.T) {
	// Valid base64 but too short to hold a nonce
	import64 := "AAAA" // 3 bytes decoded — shorter than AES-GCM nonce (12 bytes)
	_, err := DecryptData(import64)
	if err == nil {
		t.Error("expected error for too-short ciphertext, got nil")
	}
}

func TestDecryptTamperedCiphertext(t *testing.T) {
	encrypted, _ := EncryptData("secret data")
	// Corrupt a byte in the middle of the base64 string
	b := []byte(encrypted)
	if len(b) > 20 {
		b[20] ^= 0xFF
	}
	_, err := DecryptData(string(b))
	if err == nil {
		t.Error("expected authentication failure for tampered ciphertext, got nil")
	}
}
