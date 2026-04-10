$f = 'c:\Users\den-a\SE\backend\controller\OrderTrackingController.js'
$lines = [System.IO.File]::ReadAllLines($f)
# Line 467: destructure addAccessories from req.body
$lines[467] = '  const { notes, preferredCompletionDate, addAccessories } = req.body || {};'
# Line 522: add addAccessories after enhancementUpdatedAt
$lines[522] = '          enhancementUpdatedAt: new Date().toISOString(),'
$newLines = $lines[0..522] + '          addAccessories: addAccessories === true' + $lines[523..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Output 'Done'
