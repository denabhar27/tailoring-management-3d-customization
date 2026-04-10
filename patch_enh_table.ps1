$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\repair.jsx'
$lines = [System.IO.File]::ReadAllLines($f)

# Remove <th>Payment Status</th> (line 3515, 0-based)
$lines[3515] = ''

# Fix colSpan from 9 to 8 (line 3522, 0-based)
$lines[3522] = "                    <tr><td colSpan=""8"" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No enhancement requests</td></tr>"

# Remove unused amountPaid, finalPrice (for payment display), remainingBalance vars (lines 3527-3529)
# Keep finalPrice as it's used for the price column display
$lines[3527] = ''  # remove amountPaid
$lines[3529] = ''  # remove remainingBalance

[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
