package dbbase

import (
	"fmt"
	"time"
)

// Step 是启动阶段的一个原子步骤（连接 DB、迁移、自举、启动自检等）。
type Step struct {
	// Name 用于日志/打点；建议形如 "db.connect" / "db.migrate" / "bootstrap.run"
	Name string
	// Run 执行逻辑；返回 error 表示失败
	Run func() error
	// Fatal 为 true 时，失败将终止整个启动流程
	Fatal bool
}

// StepEvent 为每步执行结果的回调载体。
type StepEvent struct {
	Project  string
	Name     string
	Success  bool
	Error    string
	Duration time.Duration
}

// RunSteps 顺序执行 steps；可通过 onEvent 收集耗时与失败原因（用于 stat/audit）。
func RunSteps(project string, steps []Step, onEvent func(StepEvent)) error {
	for _, st := range steps {
		if st.Run == nil {
			continue
		}
		t0 := time.Now()
		err := st.Run()
		dur := time.Since(t0)
		if onEvent != nil {
			ev := StepEvent{
				Project:  project,
				Name:     st.Name,
				Success:  err == nil,
				Duration: dur,
			}
			if err != nil {
				ev.Error = err.Error()
			}
			onEvent(ev)
		}
		if err != nil && st.Fatal {
			if st.Name != "" {
				return fmt.Errorf("%s: %w", st.Name, err)
			}
			return err
		}
	}
	return nil
}

