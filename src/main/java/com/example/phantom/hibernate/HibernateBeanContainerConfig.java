package com.example.phantom.hibernate;

import org.hibernate.cfg.AvailableSettings;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Configuration;
import org.springframework.orm.hibernate5.SpringBeanContainer;

import java.util.Map;


@Configuration
public class HibernateBeanContainerConfig implements HibernatePropertiesCustomizer {

    private final ConfigurableListableBeanFactory beanFactory;

    public HibernateBeanContainerConfig(ConfigurableListableBeanFactory beanFactory) {
        this.beanFactory = beanFactory;
    }

    @Override
    public void customize(Map<String, Object> hibernateProperties) {
        hibernateProperties.put(AvailableSettings.BEAN_CONTAINER, new SpringBeanContainer(beanFactory));
    }
}
