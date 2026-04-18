package audit

// HTTPPayload is written for each completed /api request.
type HTTPPayload struct {
	Type     string `json:"type"` // http
	Method   string `json:"method"`
	Path     string `json:"path"`
	Query    string `json:"query,omitempty"`
	Status   int    `json:"status"`
	Latency  string `json:"latency"`
	UserID   int    `json:"userId"`
	UserRole string `json:"userRole,omitempty"`
	ClientIP string `json:"clientIp,omitempty"`
}

// LogHTTP records an API access line.
func LogHTTP(p HTTPPayload) {
	p.Type = "http"
	_ = AppendJSON(p)
}
