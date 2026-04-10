$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\repair.jsx'
$lines = [System.IO.File]::ReadAllLines($f)

# Fix at index 405 (line 406) and 407 (line 408)
$lines[405] = '      const isEnhancementOrder = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;'
$lines[406] = '      const isAccessoriesEnhancement = isEnhancementOrder && !!pricingFactors.accessoriesPrice;'
$lines[407] = '      const amountPaid = (isEnhancementOrder && !isAccessoriesEnhancement) ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);'

# Fix at index 1776 (line 1777) and 1778 (line 1779)
$lines[1776] = '      const isEnhancementOrder = pricingFactors.enhancementRequest && pricingFactors.enhancementAdminAccepted;'
$lines[1777] = '      const isAccessoriesEnhancement = isEnhancementOrder && !!pricingFactors.accessoriesPrice;'
$lines[1778] = '      const amountPaid = (isEnhancementOrder && !isAccessoriesEnhancement) ? parseFloat(item.final_price || 0) : parseFloat(pricingFactors.amount_paid || 0);'

[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
