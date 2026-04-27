package statbase

import (
	"time"

	"shared/cosbase"
)

// Event 为一条打点 JSON 行（与 R-Melamine statlog.Event 字段一致）。
type Event struct {
	Type        string                 `json:"type"`
	Action      string                 `json:"action,omitempty"`
	Source      string                 `json:"source,omitempty"`
	Route       string                 `json:"route,omitempty"`
	Method      string                 `json:"method,omitempty"`
	Status      int                    `json:"status,omitempty"`
	Success     bool                   `json:"success"`
	ActorUserID int                    `json:"actorUserId,omitempty"`
	ActorRole   string                 `json:"actorRole,omitempty"`
	TargetID    string                 `json:"targetId,omitempty"`
	Table       string                 `json:"table,omitempty"`
	RequestID   string                 `json:"requestId,omitempty"`
	IP          string                 `json:"ip,omitempty"`
	UserAgent   string                 `json:"userAgent,omitempty"`
	Error       string                 `json:"error,omitempty"`
	Extra       map[string]interface{} `json:"extra,omitempty"`
	TS          string                 `json:"ts,omitempty"`
}

func (e *Event) normalize(ts time.Time) {
	e.Type = cosbase.SanitizeStatTypeSegment(e.Type)
	if e.TS == "" {
		e.TS = ts.Format(time.RFC3339Nano)
	}
}
