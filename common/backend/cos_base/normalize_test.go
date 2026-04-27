package cosbase

import "testing"

func TestNormalizeOverEncodedObjectPath(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"user_diy_3d/34/5/decal.jpeg", "user_diy_3d/34/5/decal.jpeg"},
		{"user_diy_3d%2F34%2F5%2Fdecal.jpeg", "user_diy_3d/34/5/decal.jpeg"},
		{"user_diy_3d%252F34%252F5%252Fdecal.jpeg", "user_diy_3d/34/5/decal.jpeg"},
	}
	for _, tc := range cases {
		got := NormalizeOverEncodedObjectPath(tc.in)
		if got != tc.want {
			t.Errorf("NormalizeOverEncodedObjectPath(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
