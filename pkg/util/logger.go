package util

import (
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"
	"time"
)

var (
	// Log levels
	LevelDebug = "DEBUG"
	LevelInfo  = "INFO"
	LevelWarn  = "WARN"
	LevelError = "ERROR"

	// Default log level
	currentLevel = LevelInfo

	// Color codes
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorBlue   = "\033[34m"
	colorPurple = "\033[35m"
	colorCyan   = "\033[36m"
	colorWhite  = "\033[37m"
)

// SetLogLevel sets the current logging level
func SetLogLevel(level string) {
	level = strings.ToUpper(level)
	switch level {
	case LevelDebug, LevelInfo, LevelWarn, LevelError:
		currentLevel = level
	default:
		log.Printf("Invalid log level: %s, using INFO", level)
		currentLevel = LevelInfo
	}
}

// shouldLog determines if a message at the given level should be logged
func shouldLog(level string) bool {
	switch currentLevel {
	case LevelDebug:
		return true
	case LevelInfo:
		return level != LevelDebug
	case LevelWarn:
		return level == LevelWarn || level == LevelError
	case LevelError:
		return level == LevelError
	default:
		return level != LevelDebug
	}
}

// getCallerInfo gets the caller file and line number
func getCallerInfo() string {
	_, file, line, ok := runtime.Caller(3) // Skip getCallerInfo, logWithLevel, and the log function
	if !ok {
		return "unknown:0"
	}
	// Get just the file name, not the full path
	parts := strings.Split(file, "/")
	file = parts[len(parts)-1]
	return fmt.Sprintf("%s:%d", file, line)
}

// logWithLevel logs a message with the specified level
func logWithLevel(level, format string, args ...interface{}) {
	if !shouldLog(level) {
		return
	}

	var color string
	switch level {
	case LevelDebug:
		color = colorBlue
	case LevelInfo:
		color = colorGreen
	case LevelWarn:
		color = colorYellow
	case LevelError:
		color = colorRed
	}

	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	caller := getCallerInfo()
	message := fmt.Sprintf(format, args...)

	log.Printf("%s%s [%s] %s - %s%s", color, timestamp, level, caller, message, colorReset)
}

// Debug logs a debug message
func Debug(format string, args ...interface{}) {
	logWithLevel(LevelDebug, format, args...)
}

// Info logs an info message
func Info(format string, args ...interface{}) {
	logWithLevel(LevelInfo, format, args...)
}

// Warn logs a warning message
func Warn(format string, args ...interface{}) {
	logWithLevel(LevelWarn, format, args...)
}

// Error logs an error message
func Error(format string, args ...interface{}) {
	logWithLevel(LevelError, format, args...)
}

// Fatal logs an error message and exits
func Fatal(format string, args ...interface{}) {
	logWithLevel(LevelError, format, args...)
	os.Exit(1)
}

// Init initializes the logger
func Init() {
	// Check if we should set a different log level from environment
	if level := os.Getenv("LOG_LEVEL"); level != "" {
		SetLogLevel(level)
	}

	// Configure standard logger to not print time (we add our own timestamp)
	log.SetFlags(0)
	log.SetOutput(os.Stdout)

	Info("Logger initialized with level: %s", currentLevel)
}
