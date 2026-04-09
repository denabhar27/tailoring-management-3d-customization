$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
$lines[4248] = '                     <th>Status</th>'
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
