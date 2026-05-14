package com.example.phantom.crypto.withdrawal;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "refunds")
@Getter
@Setter
@NoArgsConstructor
public class Refund {
    @Id
    @Column(name = "withdrawal_id")
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "withdrawal_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Withdrawal withdrawal;
}
