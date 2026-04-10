$repairFile = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\repair.jsx'
$custFile = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'

# Fix repair.jsx line 3645 (0-based)
$lines = [System.IO.File]::ReadAllLines($repairFile)
$lines[3644] = "                      pricingFactors: { ...pf2, enhancementRequest: false, enhancementPendingAdminReview: false, addAccessories: false, accessoriesPrice: null, accessoriesDeclineReason: null },"
# Remove the adminNotes line (not needed since updateRepairOrderItem handles it via pricingFactors)
$lines[3645] = ''
[System.IO.File]::WriteAllLines($repairFile, $lines)

# Fix Customize.jsx
$lines = [System.IO.File]::ReadAllLines($custFile)
$pfLine2 = ($lines | Select-String "enhancementRequest: false, enhancementPendingAdminReview: false, addAccessories: false" | Select-Object -First 1).LineNumber - 1
$lines[$pfLine2] = "                      pricingFactors: { ...pf2, enhancementRequest: false, enhancementPendingAdminReview: false, addAccessories: false, accessoriesPrice: null, accessoriesDeclineReason: null },"
$adminNotesLine2 = ($lines | Select-String "Enhancement cancelled. Price restored to original." | Select-Object -First 1).LineNumber - 1
$lines[$adminNotesLine2] = ''
[System.IO.File]::WriteAllLines($custFile, $lines)

Write-Output 'Done'
