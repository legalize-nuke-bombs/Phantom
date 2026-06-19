package com.example.phantom.notification;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class ReadNotificationsRequest {
    @NotNull
    @NotEmpty
    private List<@NotNull Long> ids;
}
