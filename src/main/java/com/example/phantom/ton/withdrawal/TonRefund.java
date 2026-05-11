package com.example.phantom.ton.withdrawal;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "ton_refunds")
@Getter
@Setter
@NoArgsConstructor
public class TonRefund {
    @Id
    @Column(name = "ton_withdrawal_id")
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "ton_withdrawal_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private TonWithdrawal withdrawal;
}