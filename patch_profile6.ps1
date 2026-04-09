$f = 'c:\Users\den-a\SE\tailoring-management-user\src\user\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
# Remove line at index 665 (old duplicate), also need to add back the try { line
# Current: 663='' 664=new call 665=old call 666=if(result.success)
# We also need to restore 'try {' and 'setSubmittingEnhancement(true);'
# Check what's before 664
$newLines = $lines[0..663] + $lines[665..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
