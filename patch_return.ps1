$f = 'c:\Users\den-a\SE\backend\controller\OrderController.js'
$lines = [System.IO.File]::ReadAllLines($f)
# Line 573 (0-based) should be 'return res.status(400).json({'
$lines[573] = '          return res.status(400).json({'
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
