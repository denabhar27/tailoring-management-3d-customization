$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
$newLines = $lines[0..2598] + '      const finalPrice = parseFloat(item.final_price || 0);' + $lines[2599..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
