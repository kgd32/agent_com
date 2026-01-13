# Agent Mail Check Hook - Session Start (PowerShell)
# Checks CodeWizard's inbox when a new session begins

# Read hook input from stdin
$input = [Console]::In.ReadToEnd()

# Log for debugging
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path ".gemini/hook-debug.log" -Value "[$timestamp] SessionStart hook triggered (PowerShell)"

# Output result as JSON for Gemini CLI
$output = @{
    message = "📬 Checking CodeWizard mail at session start..."
    hookSpecificOutput = @{
        mailCheckRequested = $true
    }
} | ConvertTo-Json -Compress

Write-Output $output

# Exit 0 = success
exit 0
