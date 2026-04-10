$f = 'c:\Users\den-a\SE\tailoring-management-user\src\user\Profile.jsx'
$lines = [System.IO.File]::ReadAllLines($f)

# 1. Add isAccessoriesEnhancement after isEnhancementPending (line 2405, 0-based)
$lines[2404] = '                const isEnhancementOrder = pricingFactors.enhancementRequest === true && pricingFactors.enhancementAdminAccepted === true;'
$lines[2405] = '                const isEnhancementPending = pricingFactors.enhancementRequest === true && pricingFactors.enhancementPendingAdminReview === true;'
$newLines = $lines[0..2405] + '                const isAccessoriesEnhancement = pricingFactors.enhancementRequest === true && pricingFactors.addAccessories === true && !pricingFactors.enhancementAdminAccepted;' + $lines[2406..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $newLines)

# 2. Fix the enhancement badges (now shifted +1)
$lines = [System.IO.File]::ReadAllLines($f)
$enhanceBadgeLine = ($lines | Select-String "isEnhancementOrder && \(item\.status === 'accepted'" | Select-Object -First 1).LineNumber - 1
$lines[$enhanceBadgeLine] = "                      {(isEnhancementOrder || isAccessoriesEnhancement) && (item.status === 'accepted' || item.status === 'price_confirmation' || item.status === 'confirmed' || item.status === 'in_progress') && ("
$lines[$enhanceBadgeLine + 1] = "                        <span className=""status-badge"" style={{ backgroundColor: '#ede7f6', color: '#673ab7', border: '1px solid #ce93d8', fontSize: '11px' }}>"
$lines[$enhanceBadgeLine + 2] = "                          {isAccessoriesEnhancement ? 'Enhancement + Accessories' : 'Enhancement'}"
$lines[$enhanceBadgeLine + 3] = "                        </span>"
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
