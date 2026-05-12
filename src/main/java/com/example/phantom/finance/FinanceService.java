package com.example.phantom.finance;

import org.springframework.stereotype.Service;

@Service
public class FinanceService {

    private final FinanceColors financeColors;

    public FinanceService(FinanceColors financeColors) {
        this.financeColors = financeColors;
    }

    public FinanceColors getColors() {
        return financeColors;
    }
}
