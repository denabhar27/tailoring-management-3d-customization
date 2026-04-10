$f = 'c:\Users\den-a\SE\tailoring-management-user\src\api\OrderTrackingApi.js'
$lines = [System.IO.File]::ReadAllLines($f)
$lines[140] = 'export async function requestEnhancement(orderItemId, notes, preferredCompletionDate = null, addAccessories = false) {'
$lines[144] = '      { notes, preferredCompletionDate, addAccessories },'
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
