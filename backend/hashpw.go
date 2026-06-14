package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
)

// runHashpw implements the `hashpw` subcommand. It reads a password (hidden,
// with confirmation) and prints a bcrypt entry ready to paste into the users
// file. Output uses the $2a$ prefix produced by golang.org/x/crypto/bcrypt,
// which is exactly what the login path verifies — no format mismatch.
//
// Usage:
//
//	webdesk-backend hashpw [username]
//
// With a username it prints "username:$2a$..."; without, just the hash.
func runHashpw(args []string) int {
	var username string
	if len(args) > 0 {
		username = strings.TrimSpace(args[0])
	}

	password, err := readPassword("Password: ")
	if err != nil {
		fmt.Fprintln(os.Stderr, "error reading password:", err)
		return 1
	}
	if password == "" {
		fmt.Fprintln(os.Stderr, "error: empty password")
		return 1
	}

	confirm, err := readPassword("Confirm password: ")
	if err != nil {
		fmt.Fprintln(os.Stderr, "error reading password:", err)
		return 1
	}
	if password != confirm {
		fmt.Fprintln(os.Stderr, "error: passwords do not match")
		return 1
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error generating hash:", err)
		return 1
	}

	if username != "" {
		fmt.Printf("%s:%s\n", username, string(hash))
	} else {
		fmt.Println(string(hash))
	}
	return 0
}

// stdinReader is shared across readPassword calls so that buffered bytes from
// one read (e.g. the second piped line) are not lost between prompts.
var stdinReader *bufio.Reader

// readPassword reads a line without echoing when stdin is a terminal, and
// falls back to a plain read when it is piped (so scripts can feed it).
func readPassword(prompt string) (string, error) {
	fd := int(os.Stdin.Fd())
	if term.IsTerminal(fd) {
		fmt.Fprint(os.Stderr, prompt)
		b, err := term.ReadPassword(fd)
		fmt.Fprintln(os.Stderr)
		return string(b), err
	}

	if stdinReader == nil {
		stdinReader = bufio.NewReader(os.Stdin)
	}
	line, err := stdinReader.ReadString('\n')
	return strings.TrimRight(line, "\r\n"), err
}
