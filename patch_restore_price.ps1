$repairFile = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\repair.jsx'
$custFile = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'

# Fix repair.jsx line 3641-3644 (0-based 3640-3643)
$lines = [System.IO.File]::ReadAllLines($repairFile)
$lines[3640] = "                    const pf2 = typeof enhancementViewItem.pricing_factors === 'string' ? JSON.parse(enhancementViewItem.pricing_factors || '{}') : (enhancementViewItem.pricing_factors || {});"
$lines[3641] = "                    const originalPrice = parseFloat(pf2.accessoriesBasePrice || enhancementViewItem.final_price || 0);"
$lines[3642] = "                    const result = await updateRepairOrderItem(enhancementViewItem.item_id, {"
$lines[3643] = "                      approvalStatus: 'completed',"
$newRepairLines = $lines[0..3643] + "                      finalPrice: originalPrice," + "                      adminNotes: 'Enhancement cancelled. Price restored to original.'," + $lines[3644..($lines.Count-1)]
[System.IO.File]::WriteAllLines($repairFile, $newRepairLines)

# Fix Customize.jsx - find the same pattern
$lines = [System.IO.File]::ReadAllLines($custFile)
$cancelLine = ($lines | Select-String "const pf2 = typeof enhancementViewItem" | Select-Object -First 1).LineNumber - 1
$lines[$cancelLine] = "                    const pf2 = typeof enhancementViewItem.pricing_factors === 'string' ? JSON.parse(enhancementViewItem.pricing_factors || '{}') : (enhancementViewItem.pricing_factors || {});"
$lines[$cancelLine + 1] = "                    const originalPrice = parseFloat(pf2.accessoriesBasePrice || enhancementViewItem.final_price || 0);"
$lines[$cancelLine + 2] = "                    const result = await updateCustomizationOrderItem(enhancementViewItem.item_id, {"
$lines[$cancelLine + 3] = "                      approvalStatus: 'completed',"
$newCustLines = $lines[0..($cancelLine+3)] + "                      finalPrice: originalPrice," + "                      adminNotes: 'Enhancement cancelled. Price restored to original.'," + $lines[($cancelLine+4)..($lines.Count-1)]
[System.IO.File]::WriteAllLines($custFile, $newCustLines)

Write-Output 'Done'
