-- A sitting stays on the price card until the cutoff day of that sitting's own month.
-- ACCA drops the current sitting on the 5th: December stays through 4 December.

UPDATE qualification_offer_rules
SET cutoff_day = 5,
    updated_at = NOW()
WHERE qualification = 'ACCA'
  AND offer_type = 'exam_sessions';
