$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
# Remove lines 2596-2599 (0-based): old isEnhancementOrder, blank, old amountPaid, blank
$newLines = $lines[0..2595] + $lines[2600..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
