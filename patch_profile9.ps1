$f = 'c:\Users\den-a\SE\tailoring-management-user\src\user\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
$lines[4293] = "                  <p style={{ marginTop: '6px', fontSize: '13px', color: '#e65100' }}>"
$lines[4294] = "                    Adding accessories requires additional payment. The admin will provide the price for your confirmation."
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
