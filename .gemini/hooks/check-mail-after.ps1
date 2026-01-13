# Agent Mail Check Hook - After Tool (PowerShell)
# Checks mail after completing verification phases

# Read hook input from stdin
$hookInput = [Console]::In.ReadToEnd()

# Parse JSON input
$hookData = $hookInput | ConvertFrom-Json

# Log for debugging
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$toolName = if ($hookData.tool_name) { $hookData.tool_name } else { "unknown" }
Add-Content -Path ".gemini/hook-debug.log" -Value "[$timestamp] AfterTool hook: $toolName"

# Only check mail after task_boundary tool
if ($toolName -eq "task_boundary") {
    $output = @{
        message            = "📬 Task completed - checking mail..."
        hookSpecificOutput = @{
            mailCheckRequested = $true
        }
    } | ConvertTo-Json -Compress
}
else {
    # Silent for other tools
    $output = "{}"
}

Write-Output $output
exit 0
