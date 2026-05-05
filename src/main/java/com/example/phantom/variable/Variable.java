package com.example.phantom.variable;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "variables")
@Getter
@Setter
@NoArgsConstructor
public class Variable {
    @Id
    private String id;

    private String value;
}
