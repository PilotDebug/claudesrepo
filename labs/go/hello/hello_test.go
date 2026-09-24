package main

import "testing"

func TestGreet(t *testing.T) {
	cases := map[string]string{
		"":       "Hello, world!",
		"Claude": "Hello, Claude!",
	}
	for in, want := range cases {
		if got := Greet(in); got != want {
			t.Errorf("Greet(%q) = %q, want %q", in, got, want)
		}
	}
}
