package com.example.phantom;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class PhantomApplication {

    public static void main(String[] args) {

        SpringApplication.run(PhantomApplication.class, args);

    }

}
