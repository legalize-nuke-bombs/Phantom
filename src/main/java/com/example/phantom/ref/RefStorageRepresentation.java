package com.example.phantom.ref;

import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class RefStorageRepresentation {
    private final BigDecimal amount;
    private final BigDecimal total;

    public RefStorageRepresentation(RefStorage rs) {
        this.amount = rs.getAmount();
        this.total = rs.getTotal();
    }
}
