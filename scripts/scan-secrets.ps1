$roots = @('src', 'src-tauri', 'tests', 'scripts', 'README.md')
$files = foreach ($root in $roots) {
  if (Test-Path -LiteralPath $root -PathType Leaf) { Get-Item -LiteralPath $root }
  elseif (Test-Path -LiteralPath $root -PathType Container) {
    Get-ChildItem -LiteralPath $root -Recurse -File -Include *.ts,*.tsx,*.rs,*.ps1,*.md |
      Where-Object { $_.FullName -notmatch '\\(target|node_modules|dist|test-results)\\' }
  }
}
$patterns = @('sk-[A-Za-z0-9]{16,}', 'Bearer\s+[A-Za-z0-9._-]{24,}', '(api[_-]?key|secret|token)\s*[:=]\s*["''][^"'']{16,}["'']')
$hits = $files | Select-String -Pattern $patterns
if ($hits) { $hits | Format-Table; exit 1 }
Write-Output 'No secrets found in project sources.'
