$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\repair.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
# Remove lines 3550-3557 (0-based) — the payment status <td>
$newLines = $lines[0..3549] + $lines[3558..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
