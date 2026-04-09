$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
# Insert finalPrice after line 3893 (0-based), before remainingBalance
$newLines = $lines[0..3892] + '                  const finalPrice = parseFloat(item.final_price || 0);' + $lines[3893..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
