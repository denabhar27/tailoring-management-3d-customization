$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
# Insert the missing ') : getFilteredEnhancementItems().map(item => {' after line 4254 (0-based)
$newLines = $lines[0..4254] + '                  ) : getFilteredEnhancementItems().map(item => {' + $lines[4255..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
