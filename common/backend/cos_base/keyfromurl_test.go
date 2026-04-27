package cosbase

import "testing"

func TestKeyFromMediaURLWithPrefixes_OSSProxy(t *testing.T) {
	prefixes := []string{"user_diy_3d/", "trolley/"}
	pub := "https://bucket.oss-cn-shanghai.aliyuncs.com"
	raw := "/api/media/oss?key=" + "user_diy_3d%2F1%2Fa.png"
	got := KeyFromMediaURLWithPrefixes(pub, "/api/media/oss", prefixes, raw)
	want := "user_diy_3d/1/a.png"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
