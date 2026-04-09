$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)

# Remove <th>Payment Status</th> at line 4248 (0-based)
# Remove duplicate colSpan line at 4255 (old one), keep 4256 (new one)
# Remove blank Status th at 4249
$newLines = $lines[0..4247] + $lines[4249..4254] + $lines[4256..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
