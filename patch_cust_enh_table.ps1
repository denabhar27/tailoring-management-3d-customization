$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)

# Remove <th>Payment Status</th> (line 4249, 0-based)
$lines[4249] = ''

# Fix colSpan 9->8 (line 4256, 0-based)
$lines[4256] = "                    <tr><td colSpan=""8"" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No enhancement requests</td></tr>"

# Remove amountPaid and remainingBalance vars (lines 4260, 4262)
$lines[4260] = ''
$lines[4262] = ''

# Remove payment status <td> block (lines 4279-4286, 0-based)
$newLines = $lines[0..4278] + $lines[4287..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
