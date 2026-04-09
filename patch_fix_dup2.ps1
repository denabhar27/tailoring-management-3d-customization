$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
# Remove lines 3891-3893 (0-based): old isEnhancementOrder, blank, old amountPaid
$newLines = $lines[0..3890] + $lines[3894..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
