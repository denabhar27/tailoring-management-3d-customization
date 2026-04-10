$f = 'c:\Users\den-a\SE\tailoring-management-user\src\user\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
# Line 4306 is "                   setEnhancePreferredDate('');" - insert after it
$newLines = $lines[0..4306] + "                  setEnhanceAddAccessories(false);" + $lines[4307..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
