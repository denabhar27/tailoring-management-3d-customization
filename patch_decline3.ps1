$f = 'c:\Users\den-a\SE\tailoring-management-user\src\user\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
$insertLine = ($lines | Select-String 'cancelModalOpen && itemToCancel' | Select-Object -First 1).LineNumber - 1
$modalContent = [System.IO.File]::ReadAllLines('c:\Users\den-a\SE\decline_modal.txt')
$newLines = $lines[0..($insertLine-1)] + $modalContent + $lines[$insertLine..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
