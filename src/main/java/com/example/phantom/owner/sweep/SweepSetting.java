package com.example.phantom.owner.sweep;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "sweep_settings")
@Getter
@Setter
@NoArgsConstructor
public class SweepSetting {
    @Id
    private Long id = 0L;

    @Column
    private Long delay;
}
