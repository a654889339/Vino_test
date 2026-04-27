package statbase

import "time"

var statLogLoc *time.Location

func effectiveStatLoc() *time.Location {
	if statLogLoc != nil {
		return statLogLoc
	}
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}
