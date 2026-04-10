$repairFile = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\repair.jsx'
$custFile = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'

# Fix repair.jsx line 3643 (0-based = 3642)
$lines = [System.IO.File]::ReadAllLines($repairFile)
$lines[3642] = "                      approvalStatus: 'completed',"
[System.IO.File]::WriteAllLines($repairFile, $lines)

# Fix Customize.jsx line 4370 (0-based = 4369)
$lines = [System.IO.File]::ReadAllLines($custFile)
$lines[4369] = "                      approvalStatus: 'completed',"
[System.IO.File]::WriteAllLines($custFile, $lines)

Write-Output 'Done'
