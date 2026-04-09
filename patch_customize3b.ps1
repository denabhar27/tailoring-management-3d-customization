$f = 'c:\Users\den-a\SE\tailoring-management-user\src\admin\Customize.jsx'
$lines = [System.IO.File]::ReadAllLines($f)

# 1. Payment button condition (find exact line)
$payLine = ($lines | Select-String "approval_status !== 'price_confirmation' && !isEnhancementOrder" | Select-Object -First 1).LineNumber - 1
$lines[$payLine] = "                            {(item.approval_status !== 'completed' && item.approval_status !== 'cancelled' && item.approval_status !== 'price_confirmation') && (!isEnhancementOrder || (pricingFactors.accessoriesPrice && remainingBalance > 0.01)) && ("

# 2. Enhancement table accept button title
$titleLine = ($lines | Select-String 'title="Accept Enhancement"' | Select-Object -First 1).LineNumber - 1
$lines[$titleLine] = "                                  title={pf.addAccessories ? 'Set Accessories Price' : 'Accept Enhancement'}"

# 3. View modal accept button label
$acceptLine = ($lines | Select-String "savingEnhancementPrice \? 'Accepting\.\.\.' : 'Accept Enhancement'" | Select-Object -First 1).LineNumber - 1
$lines[$acceptLine] = "                  {savingEnhancementPrice ? 'Processing...' : pf.addAccessories ? 'Set Accessories Price' : 'Accept Enhancement'}"

[System.IO.File]::WriteAllLines($f, $lines)

# 4. Insert accessories warning in view modal after notes div
$lines = [System.IO.File]::ReadAllLines($f)
$notesEndLine = ($lines | Select-String "enhancementNotes \|\| 'No notes provided'" | Select-Object -First 1).LineNumber - 1
$notesCloseLine = $notesEndLine + 1  # the </div> after notes
$warning = @(
  "                {pf.addAccessories && (",
  "                  <div style={{ padding: '8px 12px', backgroundColor: '#fff3e0', borderRadius: '6px', marginBottom: '12px', border: '1px solid #ffcc80', fontSize: '13px', color: '#e65100', fontWeight: '600' }}>",
  "                    Customer requested to add accessories - price confirmation required.",
  "                  </div>",
  "                )}"
)
$lines = $lines[0..$notesCloseLine] + $warning + $lines[($notesCloseLine+1)..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $lines)

# 5. Insert accessories price modal before showEnhanceModal
$lines = [System.IO.File]::ReadAllLines($f)
$enhanceModalLine = ($lines | Select-String '^\s*\{showEnhanceModal && enhanceOrder' | Select-Object -First 1).LineNumber - 1
$modalContent = [System.IO.File]::ReadAllLines('c:\Users\den-a\SE\accessories_modal.txt')
$lines = $lines[0..($enhanceModalLine-1)] + $modalContent + $lines[$enhanceModalLine..($lines.Count-1)]
[System.IO.File]::WriteAllLines($f, $lines)

Write-Output 'All UI changes applied'
