$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\repair.jsx'
$lines = [System.IO.File]::ReadAllLines($f)

# 1. Add decline reason display after current price (line 3624, 0-based)
# Insert after line 3624
$declineInsert = @(
  '                {pf.accessoriesDeclineReason && (',
  '                  <div style={{ padding: ''8px 12px'', backgroundColor: ''#ffebee'', borderRadius: ''6px'', marginBottom: ''12px'', border: ''1px solid #ef9a9a'', fontSize: ''13px'', color: ''#c62828'' }}>',
  '                    <strong>Customer Decline Reason:</strong> {pf.accessoriesDeclineReason}',
  '                  </div>',
  '                )}'
)
$lines = $lines[0..3624] + $declineInsert + $lines[3625..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $lines)

# 2. Add Cancel Enhancement button in modal footer (find the footer)
$lines = [System.IO.File]::ReadAllLines($f)
$footerLine = ($lines | Select-String "btn-cancel.*onClick.*setShowEnhancementViewModal\(false\).*Close" | Select-Object -First 1).LineNumber - 1
$cancelBtn = @(
  '                <button',
  '                  className="btn-cancel"',
  '                  style={{ backgroundColor: ''#f44336'', color: ''white'', border: ''none'' }}',
  '                  disabled={savingEnhancementPrice}',
  '                  onClick={async () => {',
  '                    const confirmed = await confirm(''Cancel this enhancement request?'', ''Cancel Enhancement'', ''warning'');',
  '                    if (!confirmed) return;',
  '                    setSavingEnhancementPrice(true);',
  '                    const pf2 = typeof enhancementViewItem.pricing_factors === ''string'' ? JSON.parse(enhancementViewItem.pricing_factors || ''{}'') : (enhancementViewItem.pricing_factors || {});',
  '                    const result = await updateRepairOrderItem(enhancementViewItem.item_id, {',
  '                      approvalStatus: ''accepted'',',
  '                      pricingFactors: { ...pf2, enhancementRequest: false, enhancementPendingAdminReview: false, addAccessories: false, accessoriesPrice: null, accessoriesDeclineReason: null }',
  '                    });',
  '                    setSavingEnhancementPrice(false);',
  '                    if (result.success) { setShowEnhancementViewModal(false); showToast(''Enhancement cancelled.'', ''success''); loadRepairOrders(); }',
  '                    else showToast(result.message || ''Failed to cancel enhancement'', ''error'');',
  '                  }}',
  '                >',
  '                  Cancel Enhancement',
  '                </button>'
)
$lines = $lines[0..($footerLine-1)] + $cancelBtn + $lines[$footerLine..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $lines)
Write-Output 'Done'
