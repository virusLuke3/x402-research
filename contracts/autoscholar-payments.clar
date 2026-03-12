;; AutoScholar Payments Contract (V7.3 scaffold)
;; Clarity testnet-oriented invoice payment registry for x402 premium unlocks.

(define-constant contract-owner tx-sender)
(define-constant err-unauthorized (err u100))
(define-constant err-invoice-exists (err u101))
(define-constant err-invoice-not-found (err u102))
(define-constant err-already-paid (err u103))
(define-constant err-already-consumed (err u104))
(define-constant err-invalid-amount (err u105))
(define-constant err-invalid-status (err u106))

(define-map invoices
  { job-id: (string-ascii 64) }
  {
    payer: (optional principal),
    recipient: principal,
    amount: uint,
    asset: (string-ascii 32),
    memo: (string-ascii 128),
    status: uint,
    paid-at-height: (optional uint),
    payment-ref: (optional (string-ascii 128))
  }
)

(define-read-only (get-invoice (job-id (string-ascii 64)))
  (map-get? invoices { job-id: job-id })
)

(define-read-only (is-paid (job-id (string-ascii 64)))
  (match (map-get? invoices { job-id: job-id })
    invoice
      (ok (is-eq (get status invoice) u1))
    (err err-invoice-not-found)
  )
)

(define-read-only (is-consumed (job-id (string-ascii 64)))
  (match (map-get? invoices { job-id: job-id })
    invoice
      (ok (is-eq (get status invoice) u2))
    (err err-invoice-not-found)
  )
)

(define-public (create-invoice
  (job-id (string-ascii 64))
  (recipient principal)
  (amount uint)
  (asset (string-ascii 32))
  (memo (string-ascii 128))
)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-unauthorized)
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (is-none (map-get? invoices { job-id: job-id })) err-invoice-exists)
    (map-set invoices
      { job-id: job-id }
      {
        payer: none,
        recipient: recipient,
        amount: amount,
        asset: asset,
        memo: memo,
        status: u0,
        paid-at-height: none,
        payment-ref: none
      }
    )
    (ok true)
  )
)

(define-public (pay-invoice
  (job-id (string-ascii 64))
  (amount uint)
  (asset (string-ascii 32))
  (memo (string-ascii 128))
)
  (match (map-get? invoices { job-id: job-id })
    invoice
      (begin
        (asserts! (is-eq (get status invoice) u0) err-invalid-status)
        (asserts! (is-eq amount (get amount invoice)) err-invalid-amount)
        (asserts! (is-eq asset (get asset invoice)) err-invalid-status)
        (asserts! (is-eq memo (get memo invoice)) err-invalid-status)
        ;; NOTE: token transfer / post-condition enforcement is expected off-chain or in a later contract revision.
        (map-set invoices
          { job-id: job-id }
          {
            payer: (some tx-sender),
            recipient: (get recipient invoice),
            amount: (get amount invoice),
            asset: (get asset invoice),
            memo: (get memo invoice),
            status: u1,
            paid-at-height: (some block-height),
            payment-ref: (some memo)
          }
        )
        (ok true)
      )
    (err err-invoice-not-found)
  )
)

(define-public (consume-payment (job-id (string-ascii 64)))
  (match (map-get? invoices { job-id: job-id })
    invoice
      (begin
        (asserts! (is-eq tx-sender contract-owner) err-unauthorized)
        (asserts! (is-eq (get status invoice) u1) err-invalid-status)
        (map-set invoices
          { job-id: job-id }
          {
            payer: (get payer invoice),
            recipient: (get recipient invoice),
            amount: (get amount invoice),
            asset: (get asset invoice),
            memo: (get memo invoice),
            status: u2,
            paid-at-height: (get paid-at-height invoice),
            payment-ref: (get payment-ref invoice)
          }
        )
        (ok true)
      )
    (err err-invoice-not-found)
  )
)
